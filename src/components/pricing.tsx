"use client";
import Link from "next/link";
import { useState } from "react";
import { PLANS, YEARLY_MONTHS_CHARGED, formatRupees } from "@/lib/plans";

/* The physio plans, with a monthly / yearly switch. Without JavaScript the monthly prices show. */
export function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <>
      <div className="billing-toggle" role="group" aria-label="Billing period">
        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
        <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly <span className="save">2 months free</span></button>
      </div>
      <div className="plans">
        {PLANS.map((p, i) => {
          const perMonth = yearly ? Math.round((p.monthly * YEARLY_MONTHS_CHARGED) / 12) : p.monthly;
          return (
            <article key={p.id} className={`plan reveal${i ? ` d${i}` : ""}${p.featured ? " featured" : ""}`}>
              {p.featured && <span className="plan-badge">Most popular</span>}
              <h3>{p.name}</h3>
              <p className="plan-blurb">{p.blurb}</p>
              <div className="price">
                {p.monthly === 0 ? <b>Free</b> : <><b>{formatRupees(perMonth)}</b><span>/ month</span></>}
              </div>
              <p className="plan-note">
                {p.monthly === 0 ? "Free for as long as you like" : yearly ? `${formatRupees(p.monthly * YEARLY_MONTHS_CHARGED)} billed yearly` : "Billed monthly, cancel any time"}
              </p>
              <p className="plan-limit">{p.limit}</p>
              <ul className="ticks">
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link href="/signup" className={`btn block ${p.featured ? "primary" : ""}`}>{p.cta}</Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
