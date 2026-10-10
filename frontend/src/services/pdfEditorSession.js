const DATABASE_NAME = 's19-pdf-editor'
const DATABASE_VERSION = 1
const DOCUMENT_STORE = 'documents'
const STATE_STORE = 'states'
const SESSION_ID_KEY = 'w3villa-pdf-editor-session-id'
const CURRENT_RECORD_ID = 'current'

let databasePromise

export function getPdfEditorSessionId() {
	let sessionId = window.sessionStorage.getItem(SESSION_ID_KEY)
	if (!sessionId) {
		sessionId = window.crypto.randomUUID()
		window.sessionStorage.setItem(SESSION_ID_KEY, sessionId)
	}
	return sessionId
}

export function clearPdfEditorSessionId() {
	window.sessionStorage.removeItem(SESSION_ID_KEY)
}

function openDatabase() {
	if (!databasePromise) {
		databasePromise = new Promise((resolve, reject) => {
			const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
			request.onupgradeneeded = () => {
				const database = request.result
				if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
					database.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' })
				}
				if (!database.objectStoreNames.contains(STATE_STORE)) {
					database.createObjectStore(STATE_STORE, { keyPath: 'id' })
				}
			}
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error || new Error('Could not open PDF session storage.'))
			request.onblocked = () => reject(new Error('PDF session storage is blocked by another browser tab.'))
		}).catch((error) => {
			databasePromise = null
			throw error
		})
	}
	return databasePromise
}

function transact(storeNames, mode, operation) {
	return openDatabase().then((database) => new Promise((resolve, reject) => {
		const transaction = database.transaction(storeNames, mode)
		const result = operation(transaction)
		transaction.oncomplete = () => resolve(result)
		transaction.onerror = () => reject(transaction.error || new Error('Could not save the PDF editing session.'))
		transaction.onabort = () => reject(transaction.error || new Error('Saving the PDF editing session was aborted.'))
	}))
}

export async function loadPdfEditorSession(sessionId, ownerEmail) {
	return openDatabase().then((database) => new Promise((resolve, reject) => {
		const transaction = database.transaction([DOCUMENT_STORE, STATE_STORE], 'readonly')
		const documentRequest = transaction.objectStore(DOCUMENT_STORE).get(CURRENT_RECORD_ID)
		const stateRequest = transaction.objectStore(STATE_STORE).get(CURRENT_RECORD_ID)
		transaction.oncomplete = () => {
			const savedDocument = documentRequest.result
			const savedState = stateRequest.result
			if (savedDocument?.sessionId !== sessionId
				|| savedDocument?.ownerEmail !== ownerEmail
				|| savedState?.sessionId !== sessionId
				|| savedState?.ownerEmail !== ownerEmail) {
				resolve(null)
				return
			}
			resolve({ document: savedDocument, state: savedState })
		}
		transaction.onerror = () => reject(transaction.error || new Error('Could not restore the PDF editing session.'))
		transaction.onabort = () => reject(transaction.error || new Error('Restoring the PDF editing session was aborted.'))
	}))
}

export function savePdfEditorDocument(sessionId, ownerEmail, file, bytes) {
	return transact([DOCUMENT_STORE], 'readwrite', (transaction) => (
		transaction.objectStore(DOCUMENT_STORE).put({
			id: CURRENT_RECORD_ID,
			sessionId,
			ownerEmail,
			name: file.name,
			lastModified: file.lastModified,
			bytes: bytes.slice().buffer,
		})
	))
}

export function savePdfEditorState(sessionId, ownerEmail, state) {
	return transact([STATE_STORE], 'readwrite', (transaction) => (
		transaction.objectStore(STATE_STORE).put({
			id: CURRENT_RECORD_ID,
			sessionId,
			ownerEmail,
			...state,
		})
	))
}

export function clearPdfEditorSession() {
	return transact([DOCUMENT_STORE, STATE_STORE], 'readwrite', (transaction) => {
		transaction.objectStore(DOCUMENT_STORE).delete(CURRENT_RECORD_ID)
		transaction.objectStore(STATE_STORE).delete(CURRENT_RECORD_ID)
	})
}
