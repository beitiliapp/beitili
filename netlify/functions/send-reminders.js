const https = require('https');

exports.handler = async function(event, context) {
  const ONESIGNAL_APP_ID   = "569868ca-1c94-4b39-a57b-1aa8ffdd3afb";
  const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;
  if (!ONESIGNAL_REST_KEY) return { statusCode: 200, body: "no key" };

  const israelTime = new Date(new Date().toLocaleString("en-US", {timeZone:"Asia/Jerusalem"}));
  const hh  = String(israelTime.getHours()).padStart(2,'0');
  const mm  = israelTime.getMinutes();
  const mmR = Math.round(mm/15)*15;
  const slot = `${hh}:${String(mmR===60?0:mmR).padStart(2,'0')}`;
  console.log('tick at', slot);

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      contents: { he: "בדיקה", en: "check" },
      headings: { he: "ביתילי", en: "Beitili" },
      data: { type:"tick", slot, silent:true },
      priority: 10,
    });
    const options = {
      hostname:'onesignal.com', path:'/api/v1/notifications', method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Key ${ONESIGNAL_REST_KEY}`,
        'Content-Length':Buffer.byteLength(payload),
      }
    };
    const req = https.request(options, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ console.log('sent:',d.slice(0,80)); resolve({statusCode:200,body:`tick ${slot}`}); });
    });
    req.on('error',e=>resolve({statusCode:500,body:e.message}));
    req.write(payload); req.end();
  });
};
