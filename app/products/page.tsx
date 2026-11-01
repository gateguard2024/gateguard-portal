import { redirect } from 'next/navigation'

// The product catalog now lives in the Nexus Catalog tab (list + full product
// pages). Old links and the sidebar "Products" entry land there.
export default function ProductsPage() {
  redirect('/?tab=catalog')
}
