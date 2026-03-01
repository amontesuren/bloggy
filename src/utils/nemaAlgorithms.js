// NEMA NU 1 ALGORITHMS - JavaScript port

function maskedMean(data, mask, n) {
  let sum = 0, count = 0
  for (let i = 0; i < n; i++) {
    if (!mask[i]) {
      sum += data[i]
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

function blockReduce(data, rows, cols, targetRows, targetCols) {
  const bR = Math.floor(rows / targetRows)
  const bC = Math.floor(cols / targetCols)
  const oR = Math.ceil(rows / bR)
  const oC = Math.ceil(cols / bC)
  const out = new Float64Array(oR * oC)
  
  for (let tr = 0; tr < oR; tr++) {
    for (let tc = 0; tc < oC; tc++) {
      let sum = 0
      for (let br = 0; br < bR; br++) {
        for (let bc = 0; bc < bC; bc++) {
          const r = tr * bR + br
          const c = tc * bC + bc
          if (r < rows && c < cols) sum += data[r * cols + c]
        }
      }
      out[tr * oC + tc] = sum
    }
  }
  return { data: out, rows: oR, cols: oC }
}

function nemaSmooth(data, rows, cols) {
  const k = [[1,2,1],[2,4,2],[1,2,1]]
  const out = new Float64Array(rows * cols)
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let val = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          let rr = r + dr
          let cc = c + dc
          // reflect at borders
          if (rr < 0) rr = 1
          else if (rr >= rows) rr = rows - 2
          if (cc < 0) cc = 1
          else if (cc >= cols) cc = cols - 2
          val += data[rr * cols + cc] * k[dr + 1][dc + 1]
        }
      }
      out[r * cols + c] = val / 16
    }
  }
  return out
}

function boundingBox(mask, rows, cols) {
  let minR = rows, maxR = 0, minC = cols, maxC = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r * cols + c]) {
        if (r < minR) minR = r
        if (r > maxR) maxR = r
        if (c < minC) minC = c
        if (c > maxC) maxC = c
      }
    }
  }
  return { minR, maxR, minC, maxC }
}

function createCFOV(ufovMask, rows, cols) {
  const bb = boundingBox(ufovMask, rows, cols)
  const fUL_r = bb.minR - 0.5
  const fUL_c = bb.minC - 0.5
  const fLR_r = bb.maxR + 0.5
  const fLR_c = bb.maxC + 0.5
  const fCr = (fUL_r + fLR_r) / 2
  const fCc = (fUL_c + fLR_c) / 2

  const UL_r = Math.ceil(0.25 * fCr + 0.75 * fUL_r - 0.5)
  const UL_c = Math.ceil(0.25 * fCc + 0.75 * fUL_c - 0.5)
  const LR_r = Math.floor(0.25 * fCr + 0.75 * fLR_r - 0.5)
  const LR_c = Math.floor(0.25 * fCc + 0.75 * fLR_c - 0.5)

  const mask = new Uint8Array(rows * cols).fill(1)
  for (let r = Math.max(0, UL_r); r <= Math.min(rows - 1, LR_r); r++) {
    for (let c = Math.max(0, UL_c); c <= Math.min(cols - 1, LR_c); c++) {
      mask[r * cols + c] = 0
    }
  }
  return mask
}

function binaryDilate(mask, rows, cols) {
  const out = new Uint8Array(mask)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r * cols + c]) {
        if (r > 0) out[(r - 1) * cols + c] = 1
        if (r < rows - 1) out[(r + 1) * cols + c] = 1
        if (c > 0) out[r * cols + c - 1] = 1
        if (c < cols - 1) out[r * cols + c + 1] = 1
      }
    }
  }
  return out
}

function unifCalc(data, mask, n) {
  let mn = Infinity, mx = -Infinity
  for (let i = 0; i < n; i++) {
    if (!mask[i]) {
      if (data[i] < mn) mn = data[i]
      if (data[i] > mx) mx = data[i]
    }
  }
  if (!isFinite(mn) || mn + mx <= 0) return 0
  return (mx - mn) / (mx + mn)
}

function diffData(data, mask, rows, cols) {
  let maxV = 0, maxH = 0
  const posV = [0, 0]
  const posH = [0, 0]

  // Vertical windows
  for (let r = 0; r <= rows - 5; r++) {
    for (let c = 0; c < cols; c++) {
      let bad = false
      let mn = Infinity, mx = -Infinity
      for (let dr = 0; dr < 5; dr++) {
        const idx = (r + dr) * cols + c
        if (mask[idx]) {
          bad = true
          break
        }
        if (data[idx] < mn) mn = data[idx]
        if (data[idx] > mx) mx = data[idx]
      }
      if (!bad && mn + mx > 0) {
        const du = 100 * (mx - mn) / (mx + mn)
        if (du > maxV) {
          maxV = du
          posV[0] = r
          posV[1] = c
        }
      }
    }
  }

  // Horizontal windows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - 5; c++) {
      let bad = false
      let mn = Infinity, mx = -Infinity
      for (let dc = 0; dc < 5; dc++) {
        const idx = r * cols + (c + dc)
        if (mask[idx]) {
          bad = true
          break
        }
        if (data[idx] < mn) mn = data[idx]
        if (data[idx] > mx) mx = data[idx]
      }
      if (!bad && mn + mx > 0) {
        const du = 100 * (mx - mn) / (mx + mn)
        if (du > maxH) {
          maxH = du
          posH[0] = r
          posH[1] = c
        }
      }
    }
  }

  return { maxVert: maxV, maxHoriz: maxH, vertPos: posV, horizPos: posH }
}

function nemaPreprocess(rawData, rows, cols, targetSize) {
  let data, R, C
  
  if (targetSize > 0) {
    const reduced = blockReduce(rawData, rows, cols, targetSize, targetSize)
    data = reduced.data
    R = reduced.rows
    C = reduced.cols
  } else {
    data = rawData.slice()
    R = rows
    C = cols
  }

  const N = R * C
  data = nemaSmooth(data, R, C)

  // Pass 1: UFOV using whole-image mean
  const allUnmasked = new Uint8Array(N)
  const thresh1 = maskedMean(data, allUnmasked, N)
  const ufov1 = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    ufov1[i] = data[i] < thresh1 ? 1 : 0
  }

  // Pass 2: refine using 0.75 × CFOV mean
  const cfov1 = createCFOV(ufov1, R, C)
  const cfovMean = maskedMean(data, cfov1, N)
  const ufov2 = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    ufov2[i] = data[i] < 0.75 * cfovMean ? 1 : 0
  }

  // Dilate mask
  const ufovFinal = binaryDilate(ufov2, R, C)
  const cfovFinal = createCFOV(ufovFinal, R, C)

  return { data, rows: R, cols: C, ufovMask: ufovFinal, cfovMask: cfovFinal }
}

export function calculateNEMA(rawData, rows, cols, targetSize) {
  const pp = nemaPreprocess(rawData, rows, cols, targetSize)
  const N = pp.rows * pp.cols

  const IUufov = 100 * unifCalc(pp.data, pp.ufovMask, N)
  const IUcfov = 100 * unifCalc(pp.data, pp.cfovMask, N)
  const duU = diffData(pp.data, pp.ufovMask, pp.rows, pp.cols)
  const duC = diffData(pp.data, pp.cfovMask, pp.rows, pp.cols)

  return {
    IUufov,
    IUcfov,
    DUvertUfov: duU.maxVert,
    DUhorizUfov: duU.maxHoriz,
    DUvertCfov: duC.maxVert,
    DUhorizCfov: duC.maxHoriz,
    vertPosU: duU.vertPos,
    horizPosU: duU.horizPos,
    vertPosC: duC.vertPos,
    horizPosC: duC.horizPos,
    data: pp.data,
    ufovMask: pp.ufovMask,
    cfovMask: pp.cfovMask,
    rows: pp.rows,
    cols: pp.cols
  }
}
