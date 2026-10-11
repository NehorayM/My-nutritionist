/** Hebrew → English translation of food searches (dictionary + optional machine translation). */
export { containsHebrew, normalizeHebrew, wordVariants } from './hebrew'
export { translateWithDictionary, type QueryTranslation, type TranslationSource } from './translate'
export { createMyMemoryTranslator, cleanTranslation, MYMEMORY_ENDPOINT, type MachineTranslator } from './machine'
export { createQueryTranslator, type QueryTranslator, type QueryTranslatorOptions } from './queryTranslator'
