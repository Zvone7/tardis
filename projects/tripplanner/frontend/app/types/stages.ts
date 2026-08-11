export interface StageLocation {
  key: string    // "lat,lng" dedup key
  name: string
  country?: string
}

export interface Stage {
  index: number
  location: StageLocation
  selectedSegmentIds: number[]
}
