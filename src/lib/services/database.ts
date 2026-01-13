/**
 * Dexie database setup for MatrUSP
 * Stores lecture data locally for offline access and fast trigram-based search
 */

import Dexie, { type Table } from 'dexie'
import type { LectureData, CampiIndex, CourseData } from '~/lib/models/types'

// Extended lecture data with computed timeframes
interface StoredLecture extends LectureData {
	periodos: string[]
}

// Trigram scores for each lecture code
type TrigramScores = Record<string, number>

export class MatruspDB extends Dexie {
	lectures!: Table<StoredLecture, string>
	trigrams!: Table<TrigramScores, string>
	metadata!: Table<string, string>
	units!: Table<string[], string>
	campi!: Table<string[], string>
	courses!: Table<CourseData, string>

	constructor() {
		super('matrusp')

		this.version(1).stores({
			lectures: 'codigo, campus, [unidade+departamento], *periodos',
			trigrams: '',
			metadata: '',
			units: '',
			campi: '',
		})

		this.version(2).stores({
			lectures: 'codigo, campus, [unidade+departamento], *periodos',
			trigrams: '',
			metadata: '',
			units: '',
			campi: '',
			courses: 'codigo, nome, unidade',
		})
	}
}

export const db = new MatruspDB()

// ============================================
// Text processing utilities (from ref/js/dbhelpers.js)
// ============================================

const STOPWORDS = new Set([
	'DE', 'DA', 'DO', 'DAS', 'DOS', 'A', 'EM', 'NO', 'NA', 'NOS', 'NAS',
	'E', 'O', 'AO', 'AS', 'OS', 'AOS', 'PARA', 'POR'
])

/** Normalize text: remove accents and convert to uppercase */
function normalizeText(text: string): string {
	return text
		.toUpperCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
}

/** Convert number to Roman numeral */
function romanize(num: number): string {
	const lookup: Record<string, number> = {
		M: 1000, CM: 900, D: 500, CD: 400, C: 100,
		XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
	}
	let roman = ''
	for (const [symbol, value] of Object.entries(lookup)) {
		while (num >= value) {
			roman += symbol
			num -= value
		}
	}
	return roman
}

/** Generate trigrams from a string for search indexing */
function generateTrigrams(str: string, asAcronym = false): string[] {
	const trigrams: string[] = []

	// Normalize and collapse Roman numerals
	str = normalizeText(str).replace(/(\b[IVXLCM]+)\s+(?=[IVXLCM])/g, '$1')

	let words = str.split(/\s+/)

	// Convert trailing numbers to Roman numerals (e.g., "Calculo 2" -> "Calculo II")
	if (words.length > 1 && /^\d+$/.test(words[words.length - 1])) {
		words[words.length - 1] = romanize(parseInt(words[words.length - 1], 10))
	}

	// Remove stopwords (except first word)
	words = words.filter((word, i) => word !== '' && (i === 0 || !STOPWORDS.has(word)))

	for (let i = 0; i < words.length; i++) {
		const word = words[i]

		// First letter marker
		trigrams.push(`${word[0]}#`)

		// First trigram with special marker (for first word only)
		if (i === 0 && word.length > 2) {
			trigrams.push(`${word[0]}${word[1]}${word[2]}!`)
		}

		// Exact word match
		trigrams.push(`${word}$`)

		// Standard trigrams
		for (let j = 0; j < word.length; j++) {
			if (j < word.length - 2) {
				trigrams.push(word[j] + word[j + 1] + word[j + 2])
			}

			// Acronym handling for short words
			if (asAcronym && word.length < 5 && j > 0) {
				trigrams.push(`${word[j - 1]}${word[j]}%`)
			}
		}

		// Sequential first letters
		if (i > 0) {
			trigrams.push(`${words[i - 1][0]}${words[i][0]}%`)
		}
	}

	return trigrams
}

// ============================================
// Database initialization
// ============================================

/** Database initialization state */
export const dbState = {
	isInitialized: false,
	isLoading: false,
	progress: 0,
	error: null as string | null,
}

/** Initialize database from db.json if needed */
export async function initializeDatabase(
	onProgress?: (progress: number) => void
): Promise<void> {
	// Check if already initialized
	const count = await db.lectures.count()
	if (count > 0) {
		dbState.isInitialized = true
		
		// Also ensure courses are loaded (might be missing from older DB versions)
		const courseCount = await db.courses.count()
		if (courseCount === 0) {
			try {
				const coursesResponse = await fetch(`${import.meta.env.BASE_URL}db/cursos.json`)
				if (coursesResponse.ok) {
					const courses: CourseData[] = await coursesResponse.json()
					await db.courses.bulkPut(courses)
				}
			} catch {
				// Courses are optional
			}
		}
		
		onProgress?.(1)
		return
	}

	dbState.isLoading = true
	dbState.progress = 0
	dbState.error = null

	try {
		// Fetch the combined database
		onProgress?.(0.05)
		const response = await fetch(`${import.meta.env.BASE_URL}db/db.json`)
		if (!response.ok) {
			throw new Error(`Failed to fetch database: ${response.status}`)
		}

		onProgress?.(0.15)
		const lectures: LectureData[] = await response.json()

		onProgress?.(0.25)

		// Process lectures and build trigram index
		const trigrams: Record<string, TrigramScores> = {}
		let trigramCount = 0

		const processedLectures: StoredLecture[] = lectures.map((lecture) => {
			// Compute timeframes (periodos) from schedules
			const timeframes = new Set<string>()

			lecture.turmas?.forEach((classroom) => {
				classroom.horario?.forEach((schedule) => {
					const hourInit = parseInt(schedule.inicio.slice(0, 2), 10)
					const hourEnd = parseInt(schedule.fim.slice(0, 2), 10)

					if (hourInit < 12) timeframes.add('matutino')
					else if (hourInit < 18) timeframes.add('vespertino')
					else timeframes.add('noturno')

					if (hourEnd > 19) timeframes.add('noturno')
					else if (hourEnd > 13) timeframes.add('vespertino')
					else timeframes.add('matutino')
				})
			})

			// Generate trigrams for this lecture
			const nameTrigrams = generateTrigrams(lecture.nome)
			const codeTrigrams = generateTrigrams(lecture.codigo)

			for (const trigram of [...nameTrigrams, ...codeTrigrams]) {
				if (!trigrams[trigram]) {
					trigrams[trigram] = {}
				}
				trigrams[trigram][lecture.codigo] = (trigrams[trigram][lecture.codigo] || 0) + 1
				trigramCount++
			}

			return {
				...lecture,
				periodos: [...timeframes],
			}
		})

		onProgress?.(0.5)

		// Weight trigrams using TF-IDF-like scoring
		const trigramEntries: [string, TrigramScores][] = []
		for (const [trigram, scores] of Object.entries(trigrams)) {
			const docCount = Object.keys(scores).length
			const weight = Math.sqrt(Math.log(trigramCount / docCount))

			const weightedScores: TrigramScores = {}
			for (const [code, count] of Object.entries(scores)) {
				weightedScores[code] = weight * Math.log(1 + count)
			}
			trigramEntries.push([trigram, weightedScores])
		}

		onProgress?.(0.65)

		// Build units index
		const units: Record<string, Set<string>> = {}
		for (const lecture of processedLectures) {
			if (!units[lecture.unidade]) {
				units[lecture.unidade] = new Set()
			}
			units[lecture.unidade].add(lecture.departamento)
		}

		onProgress?.(0.75)

		// Bulk insert into database
		await db.transaction('rw', [db.lectures, db.trigrams, db.units], async () => {
			await db.lectures.bulkPut(processedLectures)
			await db.trigrams.bulkPut(
				trigramEntries.map(([, scores]) => scores),
				trigramEntries.map(([trigram]) => trigram)
			)
			await db.units.bulkPut(
				Object.values(units).map((set) => [...set]),
				Object.keys(units)
			)
		})

		onProgress?.(0.85)

		// Fetch and store campi
		try {
			const campiResponse = await fetch(`${import.meta.env.BASE_URL}db/campi.json`)
			if (campiResponse.ok) {
				const campi: CampiIndex = await campiResponse.json()
				await db.campi.bulkPut(
					Object.values(campi),
					Object.keys(campi)
				)
			}
		} catch {
			// Campi is optional
		}

		onProgress?.(0.92)

		// Fetch and store courses
		try {
			const coursesResponse = await fetch(`${import.meta.env.BASE_URL}db/cursos.json`)
			if (coursesResponse.ok) {
				const courses: CourseData[] = await coursesResponse.json()
				await db.courses.bulkPut(courses)
			}
		} catch {
			// Courses are optional
		}

		dbState.isInitialized = true
		dbState.progress = 1
		onProgress?.(1)
	} catch (error) {
		dbState.error = error instanceof Error ? error.message : 'Unknown error'
		throw error
	} finally {
		dbState.isLoading = false
	}
}

// ============================================
// Search functions
// ============================================

/** Cache for recent trigram lookups */
const trigramCache = new Map<string, TrigramScores>()
const MAX_CACHE_SIZE = 64

/** Search lectures using trigram scoring */
export async function searchLectures(
	query: string,
	options?: {
		campus?: string
		unidade?: string
		departamento?: string
		periodos?: string[]
		limit?: number
	}
): Promise<LectureData[]> {
	const limit = options?.limit ?? 50

	// Ensure database is initialized
	if (!dbState.isInitialized) {
		await initializeDatabase()
	}

	const normalizedQuery = normalizeText(query).trim()
	if (!normalizedQuery) return []

	// Generate search trigrams
	const searchTrigrams = generateTrigrams(normalizedQuery, true)

	// Collect scores from trigrams
	const scores: Record<string, number> = {}
	const matchedCodes = new Set<string>()

	for (const trigram of searchTrigrams) {
		let trigramScores = trigramCache.get(trigram)

		if (!trigramScores) {
			trigramScores = await db.trigrams.get(trigram)
			if (trigramScores) {
				// Add to cache
				if (trigramCache.size >= MAX_CACHE_SIZE) {
					const firstKey = trigramCache.keys().next().value
					if (firstKey) trigramCache.delete(firstKey)
				}
				trigramCache.set(trigram, trigramScores)
			}
		}

		if (trigramScores) {
			for (const [code, score] of Object.entries(trigramScores)) {
				scores[code] = (scores[code] || 0) + score
				matchedCodes.add(code)
			}
		}
	}

	if (matchedCodes.size === 0) return []

	// Fetch and filter lectures
	const lecturesQuery = db.lectures.where('codigo').anyOf([...matchedCodes])

	// Apply filters
	const lectures = await lecturesQuery.toArray()

	const filtered = lectures.filter((lecture) => {
		if (options?.campus && lecture.campus !== options.campus) return false
		if (options?.unidade && lecture.unidade !== options.unidade) return false
		if (options?.departamento && lecture.departamento !== options.departamento) return false
		if (options?.periodos?.length) {
			const hasMatchingPeriodo = lecture.periodos?.some(
				(p) => options.periodos?.includes(p)
			)
			if (!hasMatchingPeriodo) return false
		}
		return true
	})

	// Normalize scores by name length (shorter names score higher for same match)
	for (const lecture of filtered) {
		if (scores[lecture.codigo]) {
			scores[lecture.codigo] /= Math.log(3 + lecture.nome.length)
		}
	}

	// Sort by score and return top results
	filtered.sort((a, b) => (scores[b.codigo] || 0) - (scores[a.codigo] || 0))

	return filtered.slice(0, limit)
}

/** Fetch a single lecture by code */
export async function fetchLecture(codigo: string): Promise<LectureData | undefined> {
	// Ensure database is initialized
	if (!dbState.isInitialized) {
		await initializeDatabase()
	}
	return db.lectures.get(codigo)
}

/** Fetch campus index */
export async function fetchCampi(): Promise<CampiIndex> {
	// Try database first
	const keys = await db.campi.toCollection().keys()
	if (keys.length > 0) {
		const values = await db.campi.toArray()
		const result: CampiIndex = {}
		keys.forEach((key, i) => {
			result[key as string] = values[i]
		})
		return result
	}

	// Fetch from server
	const response = await fetch(`${import.meta.env.BASE_URL}db/campi.json`)
	if (!response.ok) throw new Error('Failed to fetch campi index')
	return response.json()
}

/** Fetch units for a campus */
export async function fetchUnits(campus?: string): Promise<Record<string, string[]>> {
	const result: Record<string, string[]> = {}

	if (campus) {
		// Get units for specific campus
		const campiData = await fetchCampi()
		const unitNames = campiData[campus] || []

		for (const unitName of unitNames) {
			const departments = await db.units.get(unitName)
			if (departments) {
				result[unitName] = departments
			}
		}
	} else {
		// Get all units
		await db.units.each((departments, cursor) => {
			result[cursor.key as string] = departments
		})
	}

	return result
}

/** Clear all cached data */
export async function clearCache(): Promise<void> {
	await db.transaction('rw', [db.lectures, db.trigrams, db.units, db.campi, db.courses, db.metadata], async () => {
		await db.lectures.clear()
		await db.trigrams.clear()
		await db.units.clear()
		await db.campi.clear()
		await db.courses.clear()
		await db.metadata.clear()
	})
	trigramCache.clear()
	dbState.isInitialized = false
}

/** Get database statistics */
export async function getStats(): Promise<{
	lectureCount: number
	trigramCount: number
	courseCount: number
	isInitialized: boolean
}> {
	const lectureCount = await db.lectures.count()
	const trigramCount = await db.trigrams.count()
	const courseCount = await db.courses.count()
	return {
		lectureCount,
		trigramCount,
		courseCount,
		isInitialized: dbState.isInitialized,
	}
}

// ============================================
// Course functions
// ============================================

/** Fetch courses for a given unit */
export async function fetchCoursesByUnit(unidade: string): Promise<CourseData[]> {
	// Ensure DB is initialized
	if (!dbState.isInitialized) {
		await initializeDatabase()
	}
	
	// Check if courses are loaded, if not try to load them
	const courseCount = await db.courses.count()
	if (courseCount === 0) {
		try {
			const coursesResponse = await fetch(`${import.meta.env.BASE_URL}db/cursos.json`)
			if (coursesResponse.ok) {
				const courses: CourseData[] = await coursesResponse.json()
				await db.courses.bulkPut(courses)
			}
		} catch {
			// Failed to load courses
		}
	}
	
	return db.courses.where('unidade').equals(unidade).toArray()
}

/** Fetch a single course by code */
export async function fetchCourse(codigo: string): Promise<CourseData | undefined> {
	return db.courses.get(codigo)
}

/** Get all unique units that have courses */
export async function fetchCourseUnits(): Promise<string[]> {
	const units = new Set<string>()
	await db.courses.each((course) => {
		units.add(course.unidade)
	})
	return [...units].sort()
}
