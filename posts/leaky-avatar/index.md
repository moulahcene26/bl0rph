Hello, this will be a technical breakdown of my latest finding, which allowed me to read files on my target (including secrets and aws role) which lead to the compromise of their customers' PII and many other stuff, how ? jus by changing my avatar (and some config mistakes on their side lol)


![](image.png){width=60%}


alrightt let's get into the good stuff; 

so starting off, after creating your account etc.. 

after changing my avatar, for which, I have chosen a large sized image :
![](image-1.png){width=50%}

you can clearly see that the image is being resized = there's some image-processing in the backend (obv, everyone does that, does everyone hunt that tho ??? ;) )

well, we need to know (atleast), what image processor this is using, what libraries etc... 

so i sent garbage data as a profile pic, hoping to get some error stack trace 

![](image-2.png){width=90%}

well i got nothing here.... but the avatar does change to the garbage data i sent (well it doesnt render since its not a valid png image)

![](image-3.png){width=70%}

following the url and where it's being put, at `/avatar?v=5`, we get the following stack trace error :
```
image processing failed: VipsForeignLoad: "/data/blobs/avatar-388fd1ac0c032a401c0f2d9f" is not a known file format
```

we got the lead !

with this, we now know 

![](image-4.png){width=50%}

now that we know the backend is libvips, after some research, libvips ships (by default) untrusted loaders (that should be configured to be off in this case), one of the loaders (among many others) is the matload (which loads MATLAB files), 

and here comes HDF5, which is the format for the .mat files (that the matload loaders can load) ....
![](3-mat-is-hdf5.svg)
and what interesting feature does the HDF5 have ? u got it right ! reading external storage !

so now we use a small c generator against libhdf5, running it produces a .mat (which is an HDF5) file whose dataset references an external path(in this case /proc/1/environ , which contains prod secrets ...) ready to upload, so libvips routes it to matload
![](4-hdf5-layout.svg)
this is the link for the generator [build_mat73_external_block_probe.c](https://gist.github.com/moulahcene26/3138dde7e2482af586e43a0f5b578976)  


anyways, after generating the file we now have to deliver it to the image processor, how is that ? we just make as our pfp ;) ,

![](image-5.png)

oh no...

so it has to be an image type, this means we're stuck now. we need to find a way, well ....

changing the content-type was enough XD

![](image-6.png)

and just like that the poisoned .mat file is uploaded, and now it will go through the processing, since its a .mat file it will be processed using the matload loader inside libvips, which will reference the external file (/proc/1/environ) which will be returned as bytes that will be rendered as pixels..
![](6-reachability.svg)


![](image-7.png){width=70%}


and would u see, that my friend, is the content of the /proc/1/environ (secrets.. and all kinds of goods), rendered as pixels, the server has quite literally drawn me his secrets, into my profile picture, isn't that beautiful ? 

the rest is self explanatory, we decode it

 so i pull the image down and decode it 
 > grab center pixel of each block -> raw bytes -> split on \0

![](5-byte-to-block.svg)

![](9-decode.svg)

```
AWS_ROLE_ARN=arn:aws:iam::============:role/...-image-worker
AWS_DEFAULT_REGION=eu-west-1
AWS_WEB_IDENTITY_TOKEN_FILE=/var/run/secrets/eks.amazonaws.com/serviceaccount/token
DATABASE_URL=postgres://...:...@...
GITHUB_TOKEN=ghp_...
```

oh yeah...

so already, from changing my profile picture, i'm reading production secrets, db creds, a github token, internal service keys, the works. that alone is a very bad day for them, and a pretty good payday for me.


the vulnerability is done here, but the escalation isn't yet, now I want the real juice,, 

the env doesn't hand me AWS keys directly but it hands me the role it can assume, and the path to the token it authenticates with. the token itself isn't in the env, it's a separate file on disk...

...which, lucky me, i can also read. i just regenerate the payload pointing at that token path instead:

```
./build_mat73_external_block_probe poison-token.mat \
  /var/run/secrets/eks.amazonaws.com/serviceaccount/token 1202 4 0
```

same stuff... upload, flip the content-type in Burp, view avatar, decode,  and now i'm holding the worker's full EKS web-identity JWT.

now with that, i could mint temporary credentials for the production role...

i did that and i became an authenticated principal inside their production AWS account,
with those creds i could list and read their S3, and the interesting bucket was a customer-migrations one, just with pulling it
it gives real customer records, names, emails, account UUIDs, login IPs, user agents, and all the juicy stuff








\
\
\
sensational...

here's a pretty nice diagram that sums it all
![](full-chain-tree.svg){width=120%}