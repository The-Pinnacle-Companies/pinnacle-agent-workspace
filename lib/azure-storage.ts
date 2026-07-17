import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  ContainerClient,
} from '@azure/storage-blob'
import { randomUUID } from 'crypto'
import path from 'path'

// ─── Config ──────────────────────────────────────────────────────────────────

function getConfig() {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'agws-attachments'

  if (!accountName) throw new Error('[azure-storage] AZURE_STORAGE_ACCOUNT_NAME is not set')
  if (!accountKey) throw new Error('[azure-storage] AZURE_STORAGE_ACCOUNT_KEY is not set')

  return { accountName, accountKey, containerName }
}

// ─── Lazy Client ─────────────────────────────────────────────────────────────

let _blobServiceClient: BlobServiceClient | null = null
let _sharedKeyCredential: StorageSharedKeyCredential | null = null

function getBlobServiceClient(): {
  client: BlobServiceClient
  credential: StorageSharedKeyCredential
  accountName: string
  containerName: string
} {
  const { accountName, accountKey, containerName } = getConfig()

  if (!_blobServiceClient || !_sharedKeyCredential) {
    _sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey)
    _blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      _sharedKeyCredential
    )
  }

  return {
    client: _blobServiceClient,
    credential: _sharedKeyCredential,
    accountName,
    containerName,
  }
}

function getContainerClient(containerName?: string): ContainerClient {
  const { client, containerName: defaultContainer } = getBlobServiceClient()
  return client.getContainerClient(containerName ?? defaultContainer)
}

// ─── Unique blob name ─────────────────────────────────────────────────────────

function generateBlobName(originalFileName: string): string {
  const ext = path.extname(originalFileName)
  const baseName = path.basename(originalFileName, ext)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .substring(0, 60)
  const uuid = randomUUID().replace(/-/g, '')
  return `${uuid}-${baseName}${ext}`
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadFileParams {
  buffer: Buffer
  fileName: string
  mimeType: string
  containerName?: string
}

export interface UploadFileResult {
  blobUrl: string
  fileName: string
}

/**
 * Upload a file buffer to Azure Blob Storage.
 * Returns the full blob URL and the generated unique fileName.
 */
export async function uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
  const { buffer, fileName, mimeType, containerName } = params

  const containerClient = getContainerClient(containerName)

  // Ensure container exists
  await containerClient.createIfNotExists({
    access: undefined,
  })

  const blobName = generateBlobName(fileName)
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
      blobContentDisposition: `attachment; filename="${fileName}"`,
    },
  })

  return {
    blobUrl: blockBlobClient.url,
    fileName: blobName,
  }
}

// ─── SAS URL ──────────────────────────────────────────────────────────────────

/**
 * Generate a short-lived SAS URL for secure client-side download.
 * Default expiry is 60 minutes.
 */
export async function getSasUrl(blobUrl: string, expiryMinutes = 60): Promise<string> {
  const { credential, accountName, containerName: defaultContainer } = getBlobServiceClient()

  // Parse the blob URL to extract container and blob name
  const url = new URL(blobUrl)
  const pathParts = url.pathname.split('/').filter(Boolean)

  if (pathParts.length < 2) {
    throw new Error(`[azure-storage] Invalid blob URL: ${blobUrl}`)
  }

  const containerName = pathParts[0]
  const blobName = pathParts.slice(1).join('/')

  const startsOn = new Date()
  const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000)

  const permissions = new BlobSASPermissions()
  permissions.read = true

  const sasQueryParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions,
      startsOn,
      expiresOn,
    },
    credential
  )

  return `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasQueryParams.toString()}`
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a blob by its URL.
 */
export async function deleteBlob(blobUrl: string): Promise<void> {
  const { client } = getBlobServiceClient()

  const url = new URL(blobUrl)
  const pathParts = url.pathname.split('/').filter(Boolean)

  if (pathParts.length < 2) {
    throw new Error(`[azure-storage] Invalid blob URL: ${blobUrl}`)
  }

  const containerName = pathParts[0]
  const blobName = pathParts.slice(1).join('/')

  const containerClient = client.getContainerClient(containerName)
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)

  const response = await blockBlobClient.deleteIfExists()

  if (!response.succeeded) {
    console.warn(`[azure-storage] deleteBlob: blob not found or already deleted — ${blobUrl}`)
  }
}
