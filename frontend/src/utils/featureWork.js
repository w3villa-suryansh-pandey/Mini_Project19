const DATABASE_NAME = 'w3villa-feature-work'
const STORE_NAME = 'sessions'

function storageKey(key) {
	try {
		const user = JSON.parse(window.sessionStorage.getItem('w3villa-current-user') || 'null')
		return `${user?.id || user?.email || 'anonymous'}:${key}`
	} catch {
		return `anonymous:${key}`
	}
}

function openDatabase() {
	return new Promise((resolve, reject) => {
		if (!('indexedDB' in window)) return reject(new Error('Browser storage is unavailable.'))
		const request = window.indexedDB.open(DATABASE_NAME, 1)
		request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error || new Error('Could not open browser storage.'))
	})
}

export async function loadFeatureWork(key) {
	const database = await openDatabase()
	try {
		return await new Promise((resolve, reject) => {
			const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(storageKey(key))
			request.onsuccess = () => resolve(request.result || null)
			request.onerror = () => reject(request.error || new Error('Could not restore saved work.'))
		})
	} finally {
		database.close()
	}
}

export async function saveFeatureWork(key, work) {
	const database = await openDatabase()
	try {
		await new Promise((resolve, reject) => {
			const transaction = database.transaction(STORE_NAME, 'readwrite')
			transaction.objectStore(STORE_NAME).put(work, storageKey(key))
			transaction.oncomplete = resolve
			transaction.onerror = () => reject(transaction.error || new Error('Could not save work.'))
		})
	} finally {
		database.close()
	}
}
