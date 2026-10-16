// geoip-country ships no type declarations. Only the one call used here is described.
declare module "geoip-country" {
  const geoip: {
    lookup(ip: string): { country: string } | null;
  };
  export default geoip;
}
