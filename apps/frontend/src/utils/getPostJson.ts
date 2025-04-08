const headers = { "Content-Type": "application/json" };

export function postJson(url: RequestInfo | URL, body: any, callback: (arg0: { errorCode: any; }) => void) {
  fetch(url, { method: "POST", headers, body: JSON.stringify(body) })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      res.json().then((json) => callback(json));
    })
    .catch((err) => {
      callback({ errorCode: err.message });
    });
}