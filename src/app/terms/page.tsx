import type { Metadata } from "next";
import Link from "next/link";

import { ContactLink, LegalPage } from "@/components/legal/legal-page";
import { PRODUCT_NAME } from "@/config/app";

export const metadata: Metadata = {
  title: "Terms",
  description: `The terms for using ${PRODUCT_NAME}.`,
  alternates: { canonical: "/terms" },
};

/** The terms of service for kasama.space. */
export default function Page() {
  return (
    <LegalPage title="Terms">
      <p>
        These terms apply when you use {PRODUCT_NAME} at kasama.space (“the service”). By creating
        an account or using the service, you agree to them. If you use {PRODUCT_NAME} for a
        business, you confirm that you may agree to these terms on its behalf.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 and give accurate details when you sign up.</li>
        <li>
          Keep your password safe. You are responsible for what happens under your account, and you
          should tell us straight away at <ContactLink /> if you think someone else has used it.
        </li>
        <li>
          The owner of a workspace decides who joins it and what role each person has. Owners and
          admins can change roles and remove people.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you put into {PRODUCT_NAME} stays yours. You give us permission to store, copy and
        display it only as needed to run the service for you, for example to show it to your team or
        to a client you send an invoice link to.
      </p>
      <p>
        You are responsible for your content and for having the right to use it. If you keep other
        people’s personal information in your workspace, such as your clients’ contact details, you
        must handle it lawfully, including under the Data Privacy Act of 2012. Our{" "}
        <Link href="/privacy">Privacy Policy</Link> explains how we handle personal information.
      </p>

      <h2>Acceptable use</h2>
      <p>Do not use {PRODUCT_NAME} to:</p>
      <ul>
        <li>break the law, or help anyone else break it;</li>
        <li>send spam, or collect people’s details through lead forms without their consent;</li>
        <li>store or share content that is fraudulent, harmful or infringes someone’s rights;</li>
        <li>
          try to get into accounts or data that are not yours, or test, probe or overload the
          service; or
        </li>
        <li>copy, resell or reverse-engineer the service.</li>
      </ul>
      <p>
        We may suspend or close an account that breaks these rules. Where we reasonably can, we will
        tell you first and give you a chance to fix the problem.
      </p>

      <h2>Price</h2>
      <p>
        {PRODUCT_NAME} is free to use while it is in early access. If we introduce paid plans, we
        will tell you in advance, and we will not charge you unless you choose a paid plan.
      </p>

      <h2>The service</h2>
      <p>
        {PRODUCT_NAME} is in early access and still changing. We may add, change or remove features.
        We work to keep it available and your data safe, but we cannot promise it will always be
        available or free of errors. Keep your own copies of anything you cannot afford to lose,
        such as issued invoices.
      </p>
      <p>
        {PRODUCT_NAME} helps you keep records. It does not give accounting, tax or legal advice.
        Check that your invoices and records meet the rules that apply to your business, including
        those of the Bureau of Internal Revenue.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, the service is provided “as is”. We are not liable for
        indirect or consequential losses, such as lost profits, revenue or data, that come from
        using or being unable to use the service. Nothing in these terms limits liability that
        cannot be limited under Philippine law.
      </p>

      <h2>Closing your account</h2>
      <p>
        You can stop using {PRODUCT_NAME} at any time. To delete your account or workspace, email{" "}
        <ContactLink /> from the address on your account. We will delete it as described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. We will change the date at the top of this page and, for
        significant changes, tell you by email or in the app before they take effect. If you keep
        using the service after that, the new terms apply.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Republic of the Philippines. Any dispute will be
        handled by the proper courts of the Philippines.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <ContactLink />.
      </p>
    </LegalPage>
  );
}
