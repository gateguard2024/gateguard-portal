import { notFound } from 'next/navigation'

// /portal on its own isn't a page: every property has its own address
// (/portal/<site>). This used to show a hardcoded demo customer portal.
export default function PortalIndex() { notFound() }
