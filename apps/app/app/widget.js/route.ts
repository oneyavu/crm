export function GET(request: Request) {
	const origin = new URL(request.url).origin;
	const body = `(function(){
  var script=document.currentScript;
  if(!script||document.getElementById('vayu-support-widget'))return;
  var key=script.getAttribute('data-vayu-widget');
  if(!key)return;
  var side=script.getAttribute('data-position')==='left'?'left':'right';
  var frame=document.createElement('iframe');
  frame.id='vayu-support-widget';
  frame.title='VAYU support';
  frame.src='${origin}/widget/'+encodeURIComponent(key)+'?host='+encodeURIComponent(location.hostname);
  frame.style.cssText='position:fixed;bottom:0;'+side+':0;width:min(410px,100vw);height:min(650px,100vh);border:0;background:transparent;z-index:2147483000;color-scheme:dark;';
  frame.setAttribute('allow','clipboard-write');
  document.body.appendChild(frame);
})();`;
	return new Response(body, {
		headers: {
			"Content-Type": "application/javascript; charset=utf-8",
			"Cache-Control": "public, max-age=300, s-maxage=300",
			"Access-Control-Allow-Origin": "*",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
