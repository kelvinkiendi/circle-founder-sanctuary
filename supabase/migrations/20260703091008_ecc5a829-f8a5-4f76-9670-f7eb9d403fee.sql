CREATE OR REPLACE FUNCTION public.set_staff_pin(p_staff_id uuid, p_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF p_pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;
  UPDATE public.staff
     SET pin_hash = crypt(p_pin, gen_salt('bf')),
         failed_attempts = 0,
         locked_until = NULL,
         must_change_pin = false,
         active = true
   WHERE id = p_staff_id;
  RETURN FOUND;
END;
$function$;