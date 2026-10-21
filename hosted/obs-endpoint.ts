// Only the isolated Creator routes use this transport namespace. Legacy/public
// presentation stays on its original endpoint.
export function overlayEndpoint(){
 if(typeof location!=='undefined'&&location.pathname.startsWith('/creator'))return location.pathname.startsWith('/creator/obs/')?'/api/creator/view':'/api/creator/stream';
 return '/api/obs';
}
