/**
 * TypeScript type definitions for MatrUSP
 * Based on the JSON structure from JupiterWeb scraper
 */

// ============================================
// Database/API Types (from JSON files)
// ============================================

/** Schedule time slot within a classroom */
export interface ScheduleData {
	dia: DayOfWeek
	inicio: string // "HH:MM" format
	fim: string // "HH:MM" format
	professores: string[]
}

/** Vacancy information for a specific enrollment type */
export interface VacancyData {
	vagas: number
	inscritos: number
	pendentes: number
	matriculados: number
	grupos?: Record<string, VacancyData>
}

/** A classroom/section (turma) of a lecture */
export interface ClassroomData {
	codigo: string
	tipo: string // "Teórica", "Prática", etc.
	inicio: string // "DD/MM/YYYY" format
	fim: string // "DD/MM/YYYY" format
	horario: ScheduleData[]
	vagas: Record<string, VacancyData>
	observacoes?: string
}

/** A lecture/course (disciplina) */
export interface LectureData {
	codigo: string // e.g., "MAC0110"
	nome: string // e.g., "Introducao a Computacao"
	creditos_aula: number
	creditos_trabalho: number
	unidade: string // academic unit
	departamento: string
	campus: string
	turmas: ClassroomData[]
}

/** Campus index: maps campus name to list of units */
export type CampiIndex = Record<string, string[]>

/** Lecture info within a course period */
export interface CourseLectureInfo {
	codigo: string
	tipo: 'obrigatoria' | 'optativa_livre' | 'optativa_eletiva'
	req_fraco: string[]
	req_forte: string[]
	ind_conjunto: string[]
}

/** A course/curriculum (curso) */
export interface CourseData {
	codigo: string // e.g., "45052-1"
	nome: string // e.g., "Ciência da Computação"
	periodo: string // "diurno", "noturno", "matutino", "vespertino"
	unidade: string
	periodos: Record<string, CourseLectureInfo[]> // period number -> lectures
}

// ============================================
// Application State Types
// ============================================

/** Days of the week (Portuguese abbreviations) */
export type DayOfWeek = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'

/** Full day names in Portuguese */
export const DAY_NAMES: Record<DayOfWeek, string> = {
	seg: 'Segunda',
	ter: 'Terça',
	qua: 'Quarta',
	qui: 'Quinta',
	sex: 'Sexta',
	sab: 'Sábado',
	dom: 'Domingo',
} as const

/** Ordered days for display */
export const DAYS_ORDERED: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

/** Time period filters */
export type TimePeriod = 'matutino' | 'vespertino' | 'noturno'

export const TIME_PERIODS: Record<TimePeriod, { start: string; end: string; label: string }> = {
	matutino: { start: '06:00', end: '12:00', label: 'Matutino' },
	vespertino: { start: '12:00', end: '18:00', label: 'Vespertino' },
	noturno: { start: '18:00', end: '23:59', label: 'Noturno' },
} as const

// ============================================
// UI State Types
// ============================================

/** Color assigned to a lecture for display */
export type ScheduleColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const SCHEDULE_COLORS: ScheduleColor[] = [1, 2, 3, 4, 5, 6, 7, 8]

/** A lecture added to a plan with UI state */
export interface PlanLecture {
	data: LectureData
	color: ScheduleColor
	selected: boolean
	/** Selected classroom codes (empty = all selected) */
	selectedClassrooms: Set<string>
}

/** A plan containing multiple lectures */
export interface Plan {
	id: string
	name: string
	lectures: PlanLecture[]
	/** Index of the active combination */
	activeCombinationIndex: number
}

/** A valid combination of non-conflicting classrooms */
export interface Combination {
	/** Map of lecture code -> classroom code */
	classrooms: Map<string, string>
}

// ============================================
// Search Types
// ============================================

export interface SearchFilters {
	campus?: string
	unidade?: string
	periodo?: TimePeriod
	query: string
}

export interface SearchResult {
	lecture: LectureData
	matchType: 'code' | 'name' | 'teacher'
}

// ============================================
// Persistence Types
// ============================================

/** Serializable plan for localStorage */
export interface SerializedPlan {
	id: string
	name: string
	lectures: {
		codigo: string
		color: ScheduleColor
		selected: boolean
		selectedClassrooms: string[]
	}[]
	activeCombinationIndex: number
}

/** App state for localStorage */
export interface SerializedAppState {
	plans: SerializedPlan[]
	activePlanIndex: number
	version: number
}

// ============================================
// Utility Types
// ============================================

/** Time in minutes from midnight */
export type TimeMinutes = number

/** Parse "HH:MM" to minutes from midnight */
export function parseTime(time: string): TimeMinutes {
	const [hours, minutes] = time.split(':').map(Number)
	return hours * 60 + minutes
}

/** Format minutes to "HH:MM" */
export function formatTime(minutes: TimeMinutes): string {
	const h = Math.floor(minutes / 60)
	const m = minutes % 60
	return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
