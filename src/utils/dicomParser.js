// Parser DICOM genérico usando dcmjs
import dcmjs from 'dcmjs'

const { DicomMessage } = dcmjs.data

export function parseDICOM(arrayBuffer) {
  try {
    // Parse DICOM con dcmjs
    const dicomData = DicomMessage.readFile(arrayBuffer)
    const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict)
    
    // Extraer información de imagen
    const rows = dataset.Rows || 0
    const cols = dataset.Columns || 0
    const bitsAllocated = dataset.BitsAllocated || 16
    const pixelRepresentation = dataset.PixelRepresentation || 0
    const numFrames = parseInt(dataset.NumberOfFrames) || 1
    
    // Obtener pixel data
    const pixelDataElement = dicomData.dict['7FE00010']
    if (!pixelDataElement) {
      throw new Error('No se encontraron datos de píxel (tag 7FE0,0010)')
    }

    const framePixels = rows * cols
    const bytesPerPixel = bitsAllocated / 8
    
    // Determinar el tipo de array según bits allocated y representación
    let TypedArrayConstructor
    if (bitsAllocated === 8) {
      TypedArrayConstructor = Uint8Array
    } else if (bitsAllocated === 16) {
      TypedArrayConstructor = pixelRepresentation === 1 ? Int16Array : Uint16Array
    } else if (bitsAllocated === 32) {
      TypedArrayConstructor = pixelRepresentation === 1 ? Int32Array : Uint32Array
    } else {
      throw new Error(`Bits Allocated no soportado: ${bitsAllocated}`)
    }

    // Extraer frames
    const frames = []
    const pixelData = new Uint8Array(arrayBuffer, pixelDataElement.dataOffset, pixelDataElement.length)
    
    for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
      const frameOffset = frameIndex * framePixels * bytesPerPixel
      const frameBytes = pixelData.slice(frameOffset, frameOffset + framePixels * bytesPerPixel)
      
      // Crear typed array del frame
      const frameTypedArray = new TypedArrayConstructor(
        frameBytes.buffer,
        frameBytes.byteOffset,
        framePixels
      )
      
      // Convertir a Float64Array para compatibilidad
      const frameFloat = new Float64Array(framePixels)
      for (let i = 0; i < framePixels; i++) {
        frameFloat[i] = frameTypedArray[i]
      }
      
      frames.push(frameFloat)
    }

    return {
      frames,
      rows,
      cols,
      numFrames,
      bitsAllocated,
      pixelRepresentation
    }

  } catch (err) {
    console.error('Error al parsear DICOM:', err)
    throw new Error('Error al parsear archivo DICOM: ' + err.message)
  }
}
