import { NextRequest, NextResponse } from "next/server";
import { getToken, getDeviceList, getDeviceLocation, getAllDeviceLocations } from "@/lib/api/tracksolid";
import mqtt from "mqtt";

const DEFAULT_BROKER = process.env.MQTT_BROKER_URL || "mqtt://36.92.47.218:14583";

export async function GET() {
  return NextResponse.json({
    success: true,
    broker: DEFAULT_BROKER,
    topicPattern: "fleet/(imei)",
    interval: "10s",
    status: "online",
    description: "MQTT Location Publisher Endpoint & Streamer",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const account = body.account || process.env.JIMI_ACCOUNT || "tengon";
    const userPassMd5 = process.env.JIMI_PASSWORD_MD5 || "8d20684c3e199af4fca3278206f214d1";

    let token = body.accessToken;
    if (!token) {
      const authRes = await getToken("tengon", userPassMd5, 7200);
      token = (authRes as any)?.result?.accessToken;
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Gagal mendapatkan access token Jimi API" },
        { status: 401 }
      );
    }

    // 1. Fetch IMEIs for specified account
    const allImeis: string[] = [];
    try {
      const locListRes = await getAllDeviceLocations(token, account);
      const list = (locListRes as any)?.result || [];
      const imeis = (Array.isArray(list) ? list : []).map((dev: any) => dev.imei || dev.deviceId).filter(Boolean);
      allImeis.push(...imeis);
    } catch {
      // Fallback to getDeviceList
      const devRes = await getDeviceList(token, account);
      const list = (devRes as any)?.result || [];
      const imeis = (Array.isArray(list) ? list : []).map((dev: any) => dev.imei || dev.deviceId).filter(Boolean);
      allImeis.push(...imeis);
    }

    const uniqueImeis = Array.from(new Set(allImeis));

    if (uniqueImeis.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Tidak ada perangkat aktif ditemukan untuk akun "${account}".`,
        },
        { status: 404 }
      );
    }

    // 2. Fetch location details via jimi.device.location.get
    const locRes = await getDeviceLocation(token, uniqueImeis);
    const results = Array.isArray((locRes as any)?.result)
      ? (locRes as any).result
      : (locRes as any)?.result
      ? [(locRes as any).result]
      : [];

    // 3. Connect to MQTT Broker and publish payloads
    const brokerUrl = body.brokerUrl || DEFAULT_BROKER;
    const publishedTopics: string[] = [];
    const payloads: Record<string, any> = {};

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(brokerUrl, { connectTimeout: 8000 });

      const timeout = setTimeout(() => {
        client.end(true);
        reject(new Error(`Timeout menghubungkan ke MQTT broker ${brokerUrl}`));
      }, 10000);

      client.on("connect", async () => {
        clearTimeout(timeout);
        try {
          for (const item of results) {
            const imei = item.imei || item.deviceId;
            if (!imei) continue;

            const topic = `fleet/${imei}`;
            const payloadStr = JSON.stringify(item);

            await new Promise<void>((pubResolve) => {
              client.publish(topic, payloadStr, { qos: 0 }, () => {
                publishedTopics.push(topic);
                payloads[topic] = item;
                pubResolve();
              });
            });
          }
          client.end(false, () => resolve());
        } catch (pubErr) {
          client.end(true);
          reject(pubErr);
        }
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        client.end(true);
        reject(err);
      });
    });

    return NextResponse.json({
      success: true,
      account,
      broker: brokerUrl,
      deviceCount: results.length,
      publishedCount: publishedTopics.length,
      topics: publishedTopics,
      payloads,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[API /api/mqtt] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mempublikasikan ke MQTT" },
      { status: 500 }
    );
  }
}
