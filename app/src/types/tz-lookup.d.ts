declare module 'tz-lookup' {
  /** O fuso horário (IANA, por exemplo "Europe/Madrid") de umas coordenadas. */
  export default function tzLookup(lat: number, lng: number): string;
}
