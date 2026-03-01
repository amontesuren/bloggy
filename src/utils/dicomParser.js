import dicomParser from 'dicom-parser'

export function parseDICOM(arrayBuffer) {
  const byteArray = new Uint8Array(arrayBuffer)
  const dataSet = dicomParser.parseDicom(byteArray)

  const rows = dataSet.uint16('x00280010')
  const cols = dataSet.uint16('x00280011')
  const bitsAllocated = dataSet.uint16('x00280100') || 16
  const pixelRepresent = dataSet.uint16('x00280103') || 0
  const numFramesStr = dataSet.string('x00280008')
  const numFrames = numFramesStr ? parseInt(numFramesStr, 10) : 1

  const pixelEl = dataSet.elements.x7fe00010
  if (!pixelEl) throw new Error('No se encontraron datos de píxel (tag 7FE0,0010)')

  const offset = pixelEl.dataOffset
  const framePixels = rows * cols
  const bpp = bitsAllocated / 8

  function typedView(Type, byteOff, len) {
    const es = Type.BYTES_PER_ELEMENT
    if (byteOff % es === 0) return new Type(arrayBuffer, byteOff, len)
    const src = new Uint8Array(arrayBuffer, byteOff, len * es)
    const buf = new ArrayBuffer(len * es)
    new Uint8Array(buf).set(src)
    return new Type(buf, 0, len)
  }

  const TypedArr = bitsAllocated === 8 ? Uint8Array :
    bitsAllocated === 32 ? (pixelRepresent ? Int32Array : Uint32Array) :
      (pixelRepresent ? Int16Array : Uint16Array)

  const frames = []
  for (let f = 0; f < numFrames; f++) {
    const fOff = offset + f * framePixels * bpp
    const raw = typedView(TypedArr, fOff, framePixels)
    const data = new Float64Array(framePixels)
    for (let i = 0; i < framePixels; i++) data[i] = raw[i]
    frames.push(data)
  }

  return { frames, rows, cols, numFrames }
}
