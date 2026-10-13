export async function getAddressFromCoordinates(
  latitude,
  longitude
) {
  const url = new URL(
    "https://api.bigdatacloud.net/data/reverse-geocode-client"
  );

  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("localityLanguage", "en");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch address details");
  }

  const data = await response.json();

  return {
    city: data.city || data.locality || "",
    state: data.principalSubdivision || "",
    country: data.countryName || "",
    postalCode: data.postcode || ""
  };
}