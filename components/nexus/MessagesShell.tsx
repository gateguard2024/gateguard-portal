'use client'
// The Messages screen is now Nexus Mail (components/nexus/mail). Kept so anything that
// still imports MessagesShell gets the new email app.
import MailApp from '@/components/nexus/mail/MailApp'

export default function MessagesShell(props: { onClose?: () => void }) {
  return <MailApp {...props} />
}
