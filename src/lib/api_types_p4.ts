export interface Component {
  id: string;
  name: string;
  photo_url?: string;
  price?: number;
  purchase_source?: string;
  datasheet_link?: string;
  low_stock_threshold?: number;
  notes?: string;
  pending_delete: boolean;
  custom_fields: Record<string, { type: 'text' | 'number' | 'link' | 'image'; value: any }>;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

export interface ComponentTotals {
  component_id: string;
  in_storage_qty: number;
  checked_out_qty: number;
  total_owned_qty: number;
}

export interface ComponentWithTotals extends Component {
  totals: ComponentTotals;
  tags: Tag[];
}

export interface ComponentLocation {
  id: string;
  component_id: string;
  hotspot_id: string;
  quantity: number;
  hotspot?: SpatialHotspot;
  photo?: SpatialPhoto;
  room?: Room;
}
