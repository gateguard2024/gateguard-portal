'use client'

import { MyDayModal }        from '@/components/nexus/modals/MyDayModal'
import { RecentWorkModal }   from '@/components/nexus/modals/RecentWorkModal'
import { NewOppsLeadsModal } from '@/components/nexus/modals/NewOppsLeadsModal'
import { JobsModal }         from '@/components/nexus/modals/JobsModal'
import { FieldModal }        from '@/components/nexus/modals/FieldModal'
import { PeopleModal }       from '@/components/nexus/modals/PeopleModal'

export type TabId = 'my-day' | 'recent' | 'opps' | 'jobs' | 'field' | 'people'

interface Props {
  activeTab: TabId
}

export function DynamicModal({ activeTab }: Props) {
  switch (activeTab) {
    case 'my-day':  return <MyDayModal />
    case 'recent':  return <RecentWorkModal />
    case 'opps':    return <NewOppsLeadsModal />
    case 'jobs':    return <JobsModal />
    case 'field':   return <FieldModal />
    case 'people':  return <PeopleModal />
    default:        return <MyDayModal />
  }
}
