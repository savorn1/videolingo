// Compile-time checks that the hand-written API types still match the backend's OpenAPI description
// (shared/api.generated.d.ts, made by `npm run gen:api`). Nothing here runs; `npm run typecheck` fails
// when a field this app sends or reads has been renamed or retyped on the server. After a backend change,
// regenerate the file and fix what this reports.
//
// The generated types mark every field optional (the backend doesn't declare which are required), so they
// aren't used directly; this only checks names and types.
import type { components } from '#shared/api.generated'
import type { ClientSettings } from '~/composables/useSettings'
import type {
  AudioToVideoPayload,
  CreateVideoPayload,
  MergeVideosPayload,
  MultipartTicket,
  UpdateVideoPayload,
  UploadTicket,
  Video
} from '~/composables/useVideos'
import type { MediaRules } from '#shared/utils/mediaRules'

type Schemas = components['schemas']

/** A type with null and optional taken out at every level: the generated file can't say what may be null. */
type Loose<T> = T extends readonly (infer U)[] ? Loose<U>[] : T extends object ? { [K in keyof T]-?: Loose<NonNullable<T[K]>> } : NonNullable<T>
/** Fields of `Mine` the server doesn't have (never = all known). */
type UnknownFields<Mine, Theirs> = Exclude<keyof Mine, keyof Theirs>
/** Fields whose type here doesn't fit the server's (never = all fit). */
type MistypedFields<Mine, Theirs> = {
  [K in keyof Mine & keyof Theirs]-?: Loose<Mine[K]> extends Loose<Theirs[K]> ? never : K
}[keyof Mine & keyof Theirs]
/** True when every field of `Mine` exists on the server with a fitting type; otherwise the offending names. */
type Matches<Mine, Theirs> = [UnknownFields<Mine, Theirs> | MistypedFields<Mine, Theirs>] extends [never]
  ? true
  : { unknownOrMistyped: UnknownFields<Mine, Theirs> | MistypedFields<Mine, Theirs> }
type Expect<T extends true> = T

// What this app sends.
export type ApiContract = [
  Expect<Matches<AudioToVideoPayload, Schemas['AudioToVideoRequest']>>,
  Expect<Matches<MergeVideosPayload, Schemas['MergeVideosRequest']>>,
  Expect<Matches<CreateVideoPayload, Schemas['CreateVideoRequest']>>,
  Expect<Matches<UpdateVideoPayload, Schemas['UpdateVideoRequest']>>,
  // What it reads.
  Expect<Matches<UploadTicket, Schemas['UploadTicket']>>,
  Expect<Matches<MultipartTicket, Schemas['MultipartTicket']>>,
  Expect<Matches<{ url: string; length: number }, Schemas['PartUrl']>>,
  Expect<Matches<ClientSettings, Schemas['ClientSettings']>>,
  Expect<Matches<MediaRules, Schemas['MediaRules']>>,
  Expect<Matches<Video, Schemas['VideoResponse']>>
]
