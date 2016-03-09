# gulp-s3-deploy
Deploy easily to s3 using nothing but gulp!

# how to:

Just fill in the config file :)

And then 

`Usage: gulp deploy -repo [string] -to [string] -on [string]`

Options (required, for now):

  -r, --repo Repository Name (on github, for now)
  
  -t, --to   'aws' is the only option at the moment
  
  -o, --on   For builds, if you have various envs in builds/envNameHere

Exemples:
  gulp deploy --repo payments --to aws
  --on ppd --skip-install

You can use --skip-install to not install npm modules and you can use --branch name-of-branch to send only a specified branch of the repo.
