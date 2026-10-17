import type { Metadata } from "next";
import Link from "next/link";

import { ContactLink, LegalPage } from "@/components/legal/legal-page";
import { PRODUCT_NAME } from "@/config/app";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${PRODUCT_NAME} collects, uses and protects personal information.`,
  alternates: { canonical: "/privacy" },
};

/** The Privacy Policy, written for the Philippine Data Privacy Act of 2012 (RA 10173). */
export default function Page() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {PRODUCT_NAME} (“we”, “us”) is an online workspace where small businesses keep their
        contacts, sales, projects, tasks and invoices. This policy explains what personal
        information we handle, why, and the choices you have. We follow the Data Privacy Act of 2012
        (Republic Act No. 10173) and its implementing rules.
      </p>

      <h2>Who is responsible for what</h2>
      <ul>
        <li>
          <strong>Your account.</strong> For the details you give us to create and use your account,
          we decide how they are used, so we are responsible for them.
        </li>
        <li>
          <strong>What a business keeps in its workspace.</strong> Contacts, leads, deals, invoices
          and files belong to the business that owns the workspace. That business decides what goes
          in and is responsible for it; we store and process it only to run the service for them. If
          you are a client of a business that uses {PRODUCT_NAME} and want to see, correct or remove
          your details, ask that business first. We will help them answer you.
        </li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and password (stored only as a
          secure hash). If you sign in with Google, Google shares your name, email address and
          profile picture with us.
        </li>
        <li>
          <strong>Profile and workspace details:</strong> such as your photo, job title, time zone,
          business name, logo, currency and tax settings, and who is on your team.
        </li>
        <li>
          <strong>Workspace content:</strong> whatever you and your team add, such as contacts,
          companies, leads, deals, projects, tasks, comments, invoices, estimates, payments,
          expenses, receipts and photos.
        </li>
        <li>
          <strong>Lead form submissions:</strong> when someone fills in a business’s enquiry form,
          we store their answers for that business, along with where the visit came from (the page
          address, the referring site and campaign tags such as utm_source). To stop spam, we keep a
          scrambled code made from the visitor’s network address, not the address itself.
        </li>
        <li>
          <strong>Technical information:</strong> sign-in cookies, and the logs our hosting and
          database providers keep, such as network addresses, browser type and the time of each
          request.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To create your account, sign you in and keep your workspace working.</li>
        <li>
          To send the emails the service needs, such as confirming your address, resetting your
          password and team invitations.
        </li>
        <li>To keep the service secure, prevent spam and abuse, and fix problems.</li>
        <li>To understand, in aggregate, how people use our website so we can improve it.</li>
      </ul>
      <p>
        We do not sell personal information, and we do not use the content of your workspace for
        advertising.
      </p>

      <h2>Who we share it with</h2>
      <p>We use a small number of service providers to run {PRODUCT_NAME}:</p>
      <ul>
        <li>
          <strong>Supabase</strong> stores the database, sign-in and uploaded files, and sends
          account emails.
        </li>
        <li>
          <strong>Vercel</strong> hosts the website and app.
        </li>
        <li>
          <strong>Google</strong> provides “Continue with Google” sign-in, if you choose it, and
          Google Tag Manager, which loads the tools that measure visits to our website.
        </li>
      </ul>
      <p>
        These providers may process information outside the Philippines. They are bound by their own
        data protection terms, and we only give them what they need to provide their service. We may
        also disclose information if the law requires it.
      </p>
      <p>
        Inside a workspace, your teammates can see the records you share with them, according to
        their role. If you share an invoice by link, anyone who has that link can view that invoice
        until you replace the link.
      </p>

      <h2>Cookies</h2>
      <p>
        We use cookies that are needed to keep you signed in. Our website may also use measurement
        cookies, loaded through Google Tag Manager, to count visits and see which pages are useful.
        You can block or delete cookies in your browser; if you block the sign-in cookies, you will
        not be able to sign in.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and workspace for as long as you use {PRODUCT_NAME}. When you ask us to
        delete your account or workspace, we delete it from the live service within 30 days. Copies
        in backups are removed as those backups expire. We may keep a limited record where the law
        requires it.
      </p>

      <h2>How we protect it</h2>
      <p>
        Information is encrypted in transit (HTTPS). Every workspace is kept separate in the
        database, so one business cannot see another’s records, and each person only sees what their
        role allows. No method of storage or transmission is perfectly secure, but we work to
        protect your information and will tell you and the National Privacy Commission about a
        breach when the law requires it.
      </p>

      <h2>Your rights</h2>
      <p>Under the Data Privacy Act, you have the right to:</p>
      <ul>
        <li>be informed about how your personal information is processed;</li>
        <li>access the personal information we hold about you;</li>
        <li>correct information that is wrong or out of date;</li>
        <li>object to processing, and ask us to block or erase your information;</li>
        <li>get a copy of your information in a format you can use elsewhere;</li>
        <li>be compensated for damage caused by its misuse; and</li>
        <li>
          file a complaint with the National Privacy Commission (
          <a href="https://privacy.gov.ph" rel="noopener">
            privacy.gov.ph
          </a>
          ).
        </li>
      </ul>
      <p>
        You can change most of your details yourself in your profile and workspace settings. For
        anything else, email <ContactLink />. We will reply within 15 days.
      </p>

      <h2>Children</h2>
      <p>
        {PRODUCT_NAME} is a tool for businesses. It is not meant for anyone under 18, and we do not
        knowingly collect their information.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we will update the date at the top of this page. If a change is
        significant, we will also tell you by email or in the app before it takes effect.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions or requests about your personal information: <ContactLink />. See also our{" "}
        <Link href="/terms">Terms</Link>.
      </p>
    </LegalPage>
  );
}
