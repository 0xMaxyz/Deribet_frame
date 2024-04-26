import { getFrameMetadata } from "frog/next";
import type { Metadata } from "next";

import styles from "./page.module.css";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const frameTags = await getFrameMetadata(
    `${process.env.VERCEL_URL || "http://localhost:3000"}/api`
  );
  return {
    other: frameTags,
  };
}

export default function Home() {
  return (
    <main className={styles.main}>
      <img src="/frame-web.png" />

      <Link
        style={{
          fontSize: "2rem",
          marginTop: "40px",
          textDecoration: "underline",
        }}
        href="https://docs.deribet.io/"
      >
        More Info 🡕
      </Link>
    </main>
  );
}
