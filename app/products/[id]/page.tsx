import { redirect } from 'next/navigation'

// /products/<id> → the product's page in the Nexus Catalog tab.
export default function ProductRedirect({ params }: { params: { id: string } }) {
  const id = /^[0-9a-f-]{36}$/i.test(params.id) ? params.id : ''
  redirect(id ? `/?tab=catalog&product=${id}` : '/?tab=catalog')
}
