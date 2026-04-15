const toRadians = (degrees) => (degrees * Math.PI) / 180

const isFiniteNumber = (value) => Number.isFinite(Number(value))

export const distanceMilesBetween = (from, to) => {
  const fromLat = Number(from?.latitude)
  const fromLng = Number(from?.longitude)
  const toLat = Number(to?.latitude)
  const toLng = Number(to?.longitude)

  if (![fromLat, fromLng, toLat, toLng].every(isFiniteNumber)) {
    return null
  }

  const earthRadiusMiles = 3958.8
  const dLat = toRadians(toLat - fromLat)
  const dLng = toRadians(toLng - fromLng)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMiles * c
}

export const formatMilesAway = (miles) => {
  const value = Number(miles)
  if (!Number.isFinite(value) || value < 0) {
    return 'Distance unavailable'
  }

  if (value < 0.1) {
    return 'Less than 0.1 miles away'
  }

  if (value < 10) {
    return `${value.toFixed(1)} miles away`
  }

  return `${Math.round(value)} miles away`
}

export const getCurrentBrowserLocation = (timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.navigator?.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'))
      return
    }

    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
      },
    )
  })
