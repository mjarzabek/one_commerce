class SessionsController < InertiaController
  allow_unauthenticated_access only: %i[new create]
  rate_limit to: 10, within: 3.minutes, only: :create,
    with: -> { redirect_to new_session_path, alert: "Zbyt wiele prób. Spróbuj ponownie za kilka minut." }

  def new
    redirect_to root_path and return if authenticated?

    render inertia: "auth/login"
  end

  def create
    if (user = authenticate_user(email_address: params[:email_address].to_s, password: params[:password].to_s))
      start_new_session_for(user)
      redirect_to after_authentication_url
    else
      redirect_to new_session_path, inertia: { errors: { email_address: "Nieprawidłowy e-mail lub hasło." } }
    end
  end

  def destroy
    terminate_session
    redirect_to new_session_path, status: :see_other
  end
end
