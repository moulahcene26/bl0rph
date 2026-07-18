Hello, this will be a technical breakdown of my latest finding, which allowed me to read files on my target (including secrets and aws tokens) which lead to the compromise of their customers' PII and many other stuff, how ? jus by changing my avatar (and some config mistakes on their side lol)


![](image.png){width=60%}


alrightt let's get into the good stuff; 

so starting off, after creating your account etc.. 

after changing my avatar, for which, I have chosen a large sized image :
![](image-1.png){width=50%}

you can clearly see that the image is being resized = there's some image-processing in the backend (obv, everyone does that, does everyone hunt that tho ??? ;) )

well, we need to know (atleast), what image processor this is using, what libraries etc... 

so i sent garbage data as a profile pic, hoping to get some error stack trace 

![alt text](image-2.png){width=70%}

well i got nothing here.... but the avatar does change to the garbage data i sent (well it doesnt render since its not a valid png image)

![alt text](image-3.png)

following the url and where it's being put, at `/avatar?v=5`, we get the following stack trace error :
```
image processing failed: VipsForeignLoad: "/data/blobs/avatar-388fd1ac0c032a401c0f2d9f" is not a known file format
```

we got the lead !