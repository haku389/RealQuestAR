import { useEffect, useState } from "react";
import { Button, SafeAreaView, Text, View } from "react-native";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/services/firebase/auth";
import { helloCallable } from "../src/services/firebase/functions";

export default function HomeScreen() {
  const [uid, setUid] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    signInAnonymously(auth).catch((e) => setMsg(String(e)));
    return unsub;
  }, []);

  const callHello = async () => {
    try {
      const res: any = await helloCallable({});
      setMsg(JSON.stringify(res.data));
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <View style={{ gap: 12 }}>
        <Text>UID: {uid ?? "loading..."}</Text>
        <Button title="Call hello" onPress={callHello} />
        <Text>{msg}</Text>
      </View>
    </SafeAreaView>
  );
}