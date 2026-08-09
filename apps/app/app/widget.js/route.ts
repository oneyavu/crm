export function GET(request: Request) {
	const origin = new URL(request.url).origin;
	const body = `(function(){
  var script=document.currentScript;
  if(!script||document.getElementById('vayu-support-widget'))return;
  var key=script.getAttribute('data-vayu-widget');
  if(!key)return;
  var vapiKey=script.getAttribute('data-vapi-public-key');
  var vapiAssistant=script.getAttribute('data-vapi-assistant-id');
  var side=script.getAttribute('data-position')==='left'||vapiKey?'left':'right';
  var frame=document.createElement('iframe');
  frame.id='vayu-support-widget';
  frame.title='VAYU support';
  frame.src='${origin}/widget/'+encodeURIComponent(key)+'?host='+encodeURIComponent(location.hostname);
  frame.style.cssText='position:fixed;bottom:0;'+side+':0;width:min(410px,100vw);height:min(650px,100vh);border:0;background:transparent;z-index:2147483000;color-scheme:dark;';
  frame.setAttribute('allow','clipboard-write');
  document.body.appendChild(frame);
  if(vapiKey&&vapiAssistant&&!document.getElementById('vayu-vapi-widget')){
    var voice=document.createElement('vapi-widget');
    voice.id='vayu-vapi-widget';
    var attrs={mode:'voice',theme:'dark','base-color':'#000000','accent-color':'#6cd32c','button-base-color':'#000000','button-accent-color':'#ffffff',radius:'large',size:'compact',position:'bottom-right','main-label':'TALK WITH US','start-button-text':'Start','end-button-text':'End Call','require-consent':'false','local-storage-key':'vapi_widget_consent','show-transcript':'true','public-key':vapiKey,'assistant-id':vapiAssistant};
    Object.keys(attrs).forEach(function(name){voice.setAttribute(name,attrs[name]);});
    document.body.appendChild(voice);
    var sdk=document.createElement('script');
    sdk.src='https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js';
    sdk.async=true;
    sdk.type='text/javascript';
    sdk.id='vayu-vapi-sdk';
    document.head.appendChild(sdk);
  }
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
