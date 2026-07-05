import { NextRequest, NextResponse } from 'next/server'
import { MaterialParser } from '@/lib/services/MaterialParser'
import { MaterialService } from '@/lib/services/MaterialService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let _materialId: string | undefined = undefined
  try {
    // Get user ID from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get material ID from request
    const body = await request.json()
    const { materialId } = body
    // keep materialId in scope for improved error logs
    _materialId = materialId

    if (!materialId) {
      return NextResponse.json(
        { error: 'Material ID is required' },
        { status: 400 }
      )
    }

    // Get material details
    const material = await MaterialService.getMaterial(materialId)

    // Check authorization
    if (material.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if already parsed
    if (material.parsingStatus === 'completed') {
      return NextResponse.json(
        {
          message: 'Material already parsed',
          parsedContent: material.parsedContent,
        },
        { status: 200 }
      )
    }

    // Update status to processing
    const db = getSupabaseAdmin()
    await db
      .from('study_materials')
      .update({ parsing_status: 'processing' } as any)
      .eq('id', materialId)

    try {
      const isLink = material.fileType === 'youtube' || material.fileType === 'url'

      let parsedContent
      if (isLink) {
        // Link materials (youtube/url) have no stored file — parse from source URL.
        if (!material.sourceUrl) {
          throw new Error('Material is missing its source URL')
        }
        parsedContent = await MaterialParser.parseLink(
          material.sourceUrl,
          material.fileType as 'youtube' | 'url'
        )
      } else {
        // Download file from storage
        const fileBlob = await MaterialService.downloadMaterial(materialId)
        const buffer = await fileBlob.arrayBuffer()

        // Parse the file
        parsedContent = await MaterialParser.parseMaterial(
          buffer,
          material.fileType as 'pdf' | 'txt' | 'md' | 'pptx' | 'png' | 'jpg' | 'jpeg',
          material.fileSize
        )
      }

      // Validate parsed content
      if (!MaterialParser.validateParsedContent(parsedContent)) {
        throw new Error('Parsed content is empty or invalid')
      }

      // Update database with parsed content and detected language
      const { error: updateError } = await db
        .from('study_materials')
        .update({
          parsed_content: parsedContent.text,
          language: parsedContent.language || null,
          parsing_status: 'completed',
          parsing_error: null,
        } as any)
        .eq('id', materialId)

      if (updateError) {
        throw new Error(`Failed to save parsed content: ${updateError.message}`)
      }

      // Store extracted text in storage (optional backup) — file materials only.
      if (material.filePath) {
        const extractedPath = material.filePath.replace(
          /original\.\w+$/,
          'extracted.txt'
        )
        await db.storage
          .from('study-materials')
          .upload(extractedPath, parsedContent.text, {
            contentType: 'text/plain',
            upsert: true,
          })
      }

      return NextResponse.json(
        {
          message: 'Parsing completed successfully',
          parsedContent: {
            text: parsedContent.text,
            metadata: parsedContent.metadata,
            summary: MaterialParser.extractSummary(parsedContent),
          },
        },
        { status: 200 }
      )
    } catch (parseError) {
      // Update status to failed
      const errorMessage =
        parseError instanceof Error
          ? parseError.message
          : 'Unknown parsing error'

      await db
        .from('study_materials')
        .update({
          parsing_status: 'failed',
          parsing_error: errorMessage,
        } as any)
        .eq('id', materialId)

      return NextResponse.json(
        {
          error: 'Parsing failed',
          details: errorMessage,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Parse material error:', error, { materialId: _materialId })
    const message =
      error instanceof Error ? error.message : 'Failed to parse material'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
