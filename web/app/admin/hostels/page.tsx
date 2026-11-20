'use client';
import ResourceManager from '@/components/admin/ResourceManager';
import { range } from '@/lib/format';

export default function AdminHostels() {
  return (
    <ResourceManager
      resource="hostels"
      title="PG & Hostels"
      defaults={{ type: 'PG', gender: 'Co-ed', currency: 'INR', rent_period: 'month', is_published: true, country: 'India' }}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, full: true },
        { name: 'type', label: 'Type', type: 'select', options: ['PG', 'Hostel', 'Flat', 'Homestay'], required: true },
        { name: 'gender', label: 'For', type: 'select', options: ['Boys', 'Girls', 'Co-ed'], required: true },
        { name: 'college_id', label: 'Nearest college', type: 'college' },
        { name: 'country', label: 'Country', type: 'text', required: true },
        { name: 'city', label: 'City', type: 'text', required: true },
        { name: 'address', label: 'Area / address', type: 'text', full: true },
        { name: 'latitude', label: 'Latitude', type: 'number' },
        { name: 'longitude', label: 'Longitude', type: 'number' },
        { name: 'rent_min', label: 'Rent from', type: 'number' },
        { name: 'rent_max', label: 'Rent up to', type: 'number' },
        { name: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SGD', 'NZD'], required: true },
        { name: 'rent_period', label: 'Per', type: 'select', options: ['month', 'week', 'semester', 'year'], required: true },
        { name: 'amenities', label: 'Amenities', type: 'tags', full: true, placeholder: 'Food, Wi-Fi, AC, Laundry, CCTV' },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'photos', label: 'Photos', type: 'images' },
        { name: 'contact_name', label: 'Contact name', type: 'text' },
        { name: 'contact_phone', label: 'Contact phone / WhatsApp', type: 'text' },
        { name: 'contact_email', label: 'Contact email', type: 'text' },
        { name: 'is_verified', label: 'Verified by us', type: 'bool' },
        { name: 'is_published', label: 'Published', type: 'bool' },
      ]}
      columns={[
        { key: 'name', label: 'Stay', render: (r) => <div><p className="font-semibold text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.type} · {r.gender} · {r.city}</p></div> },
        { key: 'rent', label: 'Rent', render: (r) => range(r.rent_min, r.rent_max, r.currency) },
        { key: 'is_verified', label: 'Verified', render: (r) => (r.is_verified ? <span className="chip-green">Yes</span> : <span className="chip">No</span>) },
        { key: 'is_published', label: 'Status', render: (r) => (r.is_published ? <span className="chip-green">Live</span> : <span className="chip">Draft</span>) },
      ]}
    />
  );
}
