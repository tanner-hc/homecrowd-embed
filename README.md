# Homecrowd Embed

A lightweight webview SDK for embedding Homecrowd rewards, cards, and authentication into any mobile app. Load a URL in your app's WebView — no native SDK required.

## Quick Start

Point your WebView at:

```
https://embed.gethomecrowd.com/?baseUrl=https://api.gethomecrowd.com&token=USER_TOKEN&view=rewards
```

That's it. The webview handles authentication, navigation, and rendering.

## URL Parameters

| Parameter      | Required | Description                                      | Default                          |
|----------------|----------|--------------------------------------------------|----------------------------------|
| `baseUrl`      | No       | API server URL                                   | `https://api.gethomecrowd.com`   |
| `token`        | No       | Partner token for auto-login (`email:email:pass`) | —                                |
| `view`         | No       | Initial view: `rewards`, `cards`, or `login`     | `rewards`                        |
| `primaryColor` | No       | Hex color without `#` (e.g. `00C8FF`)            | `00C8FF`                         |

If no `token` is provided, the user sees a login screen.

## Platform Examples

### iOS (Swift / WKWebView)

```swift
import WebKit

let params = "baseUrl=https://api.gethomecrowd.com&token=\(userToken)&view=rewards"
let url = URL(string: "https://embed.gethomecrowd.com/?\(params)")!

let webView = WKWebView(frame: view.bounds)
webView.load(URLRequest(url: url))
view.addSubview(webView)
```

### Android (Kotlin / WebView)

```kotlin
import android.webkit.WebView

val params = "baseUrl=https://api.gethomecrowd.com&token=$userToken&view=rewards"
val url = "https://embed.gethomecrowd.com/?$params"

val webView = WebView(this)
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.loadUrl(url)
setContentView(webView)
```

### React Native

```jsx
import { WebView } from 'react-native-webview';

const params = `baseUrl=https://api.gethomecrowd.com&token=${userToken}&view=rewards`;

<WebView
  source={{ uri: `https://embed.gethomecrowd.com/?${params}` }}
  javaScriptEnabled={true}
  domStorageEnabled={true}
/>
```

### Flutter

```dart
import 'package:webview_flutter/webview_flutter.dart';

final params = 'baseUrl=https://api.gethomecrowd.com&token=$userToken&view=rewards';

WebView(
  initialUrl: 'https://embed.gethomecrowd.com/?$params',
  javascriptMode: JavascriptMode.unrestricted,
)
```

## Listening for Events

The webview sends events to the native layer via `postMessage`. Each event has a `type` and optional `payload`.

| Event                        | Payload              | Description                     |
|------------------------------|----------------------|---------------------------------|
| `homecrowd:ready`            | —                    | Webview loaded and ready        |
| `homecrowd:login`            | `{ user }`           | User authenticated              |
| `homecrowd:logout`           | —                    | User logged out                 |
| `homecrowd:route-change`     | `{ route }`          | Navigation occurred             |
| `homecrowd:card-link`        | `{ type }`           | Card linking initiated          |
| `homecrowd:error`            | `{ message }`        | Something went wrong            |

### Listening in React Native

```jsx
<WebView
  source={{ uri: embedUrl }}
  onMessage={(event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'homecrowd:login') {
      console.log('User logged in:', data.payload.user);
    }
  }}
/>
```

### Listening in iOS (Swift)

```swift
// Set up WKScriptMessageHandler
webView.configuration.userContentController.add(self, name: "homecrowd")

func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let body = message.body as? [String: Any],
          let type = body["type"] as? String else { return }
    print("Event: \(type), payload: \(body["payload"] ?? "")")
}
```

### Listening in Android (Kotlin)

```kotlin
webView.addJavascriptInterface(object {
    @JavascriptInterface
    fun postMessage(json: String) {
        val data = JSONObject(json)
        val type = data.getString("type")
        Log.d("HomecrowdEmbed", "Event: $type")
    }
}, "HomecrowdBridge")
```

## Sending Commands to the Webview

You can control the webview at runtime by evaluating JavaScript:

```js
// Navigate to a view
HomecrowdEmbed.navigate('cards')

// Reconfigure (e.g. pass a new token)
HomecrowdEmbed.configure({ token: 'email:user@example.com:pass', view: 'rewards' })
```

### From iOS

```swift
webView.evaluateJavaScript("HomecrowdEmbed.navigate('cards')")
```

### From Android

```kotlin
webView.evaluateJavascript("HomecrowdEmbed.navigate('cards')", null)
```

### From React Native

```jsx
webViewRef.current.injectJavaScript("HomecrowdEmbed.navigate('cards'); true;");
```

## Development

```bash
npm install
npm run dev        # Start dev server at http://localhost:5173
npm run build      # Production build to dist/
npm run preview    # Preview production build
```

When developing locally, load the embed at:

```
http://localhost:5173/?baseUrl=http://localhost:8000
```
