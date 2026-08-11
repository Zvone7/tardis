export const EARTH_TEXTURES = {
  "4k": {
    light: "/earth-blue-marble.jpg",
    dark: "/earth-night.jpg",
    minAltitude: 0.16,
  },
  "8k": {
    light: "/earth-blue-marble-8k.jpg",
    dark: "/earth-night-8k.jpg",
    minAltitude: 0.08,
  },
} as const

export type EarthTextureResolution = keyof typeof EARTH_TEXTURES

export function selectEarthTextureResolution(maxTextureSize: number): EarthTextureResolution {
  return maxTextureSize >= 8192 ? "8k" : "4k"
}

export function detectEarthTextureResolution(): EarthTextureResolution {
  const canvas = document.createElement("canvas")
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl")

  if (!gl) return "4k"

  const resolution = selectEarthTextureResolution(
    gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  )

  gl.getExtension("WEBGL_lose_context")?.loseContext()
  return resolution
}
