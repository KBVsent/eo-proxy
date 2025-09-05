interface GeoProperties {
  asn: number;
  countryName: string;
  countryCodeAlpha2: string;
  countryCodeAlpha3: string;
  countryCodeNumeric: string;
  regionName: string;
  regionCode: string;
  cityName: string;
  latitude: number;
  longitude: number;
  cisp: string;
}

interface IncomingRequestEoProperties {
  geo: GeoProperties;
  uuid: string;
  clientIp: string;
}

interface EORequest extends Request {
  readonly eo: IncomingRequestEoProperties;
}

// 域名映射表
const domainMappings = {
  "/steam-store": "https://store.steampowered.com",
  "/steam-api": "https://api.steampowered.com",
  "/gb": "https://github.com",
  "/gs": "https://raw.githubusercontent.com",
  "/mai": "https://maimaidx.jp/maimai-mobile/img",
  "/hg": "https://huggingface.co",
  "/fish": "https://www.diving-fish.com/api/maimaidxprober",
};

const specialCases = {
  "*": {
    "Origin": "DELETE",
    "Referer": "DELETE"
  }
};

function handleSpecialCases(headers: Headers) {
  const rules = specialCases["*"];
  for (const [key, value] of Object.entries(rules)) {
    switch (value) {
      case "KEEP":
        break;
      case "DELETE":
        headers.delete(key);
        break;
      default:
        headers.set(key, value);
        break;
    }
  }
}

// 处理 OPTIONS 预检请求
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// 处理所有请求
export async function onRequest({ request }: { request: EORequest }) {
  // 处理 URL
  const url = new URL(request.url);

  // 如果是访问根目录就返回一个HTML
  if (url.pathname === "/") {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f9f9f9;
            }
            h1 {
              font-family: Arial, sans-serif;
              color: #333;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>Ciallo～(∠・ω< )⌒☆</h1>
        </body>
      </html>
    `, {
      headers: { 
        "Content-Type": "text/html; charset=UTF-8"
      }
    });
  }

  const basePath = Object.keys(domainMappings).find(path => url.pathname.startsWith(path));
  if (!basePath) {
    return new Response("Path not found in domain mappings", { status: 404 });
  }

  const targetBase = domainMappings[basePath];
  const remainingPath = url.pathname.slice(basePath.length);
  
  // 确保正确拼接URL，避免new URL的绝对路径问题
  const targetUrl = new URL(targetBase + remainingPath + url.search + url.hash);

  // 请求头处理
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("Accept-Encoding");
  
  // 应用特殊案例处理
  handleSpecialCases(headers);

  // 请求体处理，仅在允许的情况下传递 body
  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  // 生成回源请求
  const modifiedRequest = new Request(targetUrl.toString(), {
    method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'follow'
  });

  try {
    // 发起请求
    const response = await fetch(modifiedRequest);

    // 拷贝响应，方便后续修改
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // 处理响应头
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');

    // 返回响应
    return modifiedResponse;
  } catch (e: any) {
    // 返回错误
    return new Response(
      JSON.stringify({ error: e?.message || String(e), url: targetUrl.toString() }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
