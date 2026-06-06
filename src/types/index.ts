export interface Unit {
  id: string
  name: string
  address?: string
}

export interface Customer {
  id: string
  name: string
  cpf: string
  whatsapp: string
  birth_date: string
  gender?: string
  email?: string
  play_style?: string
  weapon_type?: string
  photo_url?: string
  is_star?: boolean
  is_legacy?: boolean
  created_at?: string
}

export interface AccessType {
  id: string
  name: string
  description?: string
  price: number
  active: boolean
}

export interface PaymentMethod {
  id: string
  name: string
  fee_amount: number
  active: boolean
}

export interface UnitAccessPrice {
  id: string
  unit_id: string
  access_type_id: string
  price: number
  use_default: boolean
}

export interface UnitPaymentFee {
  id: string
  unit_id: string
  payment_method_id: string
  fee_amount: number
  use_default: boolean
}

export interface Visit {
  id: string
  customer_id: string
  unit_id: string
  access_type_id: string
  payment_method_id: string
  base_amount: number
  fee_amount: number
  total_amount: number
  operator_name?: string
  notes?: string
  visited_at: string
}

export interface SaleState {
  step: 1 | 2 | 3 | 4
  customer: Customer | null
  accessType: AccessType | null
  paymentMethod: PaymentMethod | null
  baseAmount: number
  feeAmount: number
  totalAmount: number
}
