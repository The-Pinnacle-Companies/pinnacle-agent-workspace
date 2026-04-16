import { auth } from '@/lib/auth'
import { uploadFile } from '@/lib/azure-storage'
import { NextResponse } from 'next/server'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/msword', // doc
  'text/plain',
  'text/csv',
])

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25MB

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') ?? ''
    if (!contentType.startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: `File type "${file.type}" is not allowed. Allowed types: images, PDF, DOCX, XLSX, TXT`,
        },
        { status: 422 }
      )
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds maximum size of 25MB (got ${Math.round(file.size / 1024 / 1024)}MB)` },
        { status: 422 }
      )
    }

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Azure Blob Storage
    const result = await uploadFile({
      buffer,
      fileName: file.name,
      mimeType: file.type,
    })

    return NextResponse.json({
      blobUrl: result.blobUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    })
  } catch (err) {
    console.error('[POST /api/files/upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
