import { BASE } from "@/lib/base";
import { STORAGE } from "@/lib/theme";

const pick = `(function(){var l="fa";try{var s=localStorage.getItem("${STORAGE.lang}");if(s==="fa"||s==="en")l=s;else if(!/^fa/i.test(navigator.language||""))l="en";}catch(e){}location.replace("${BASE}/"+l+"/");})();`;

export default function RootRedirect() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: pick }} />
      <noscript>
        <meta httpEquiv="refresh" content={`0; url=${BASE}/fa/`} />
      </noscript>
    </>
  );
}
