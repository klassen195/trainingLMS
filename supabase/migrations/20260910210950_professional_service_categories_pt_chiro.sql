-- Add Physical Therapy and Chiropractor categories.

alter type public.professional_service_category add value if not exists 'physical_therapy' before 'mechanic';
alter type public.professional_service_category add value if not exists 'chiropractor' before 'mechanic';
