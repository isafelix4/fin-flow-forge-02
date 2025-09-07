-- Este script corrige a função handle_new_user para alinhar com a estrutura da tabela 'profiles'.
-- A versão anterior tentava inserir um 'email_hash', que não existe na tabela, causando o erro de cadastro.
-- Esta versão remove a coluna 'email_hash' da instrução INSERT, garantindo a criação bem-sucedida do perfil do usuário.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email
    );

    -- A inserção no log de auditoria é mantida para fins de segurança.
    PERFORM public.log_security_event(
      'user_registered',
      jsonb_build_object('user_id', NEW.id)
    );

    RETURN NEW;
END;
$$;