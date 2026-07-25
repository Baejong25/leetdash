class Solution {
    public int countPrimes(int n) {

        if(n <= 2){
            return 0;
        }

        boolean[] primeN = new boolean[n];
        int count = 1;

        for(int i = 3; i < n; i+=2){

            if(primeN[i]){
                continue;
            }

            for(int j = i; (long) i * j < n; j+=2){
                primeN[j * i] = true;
            }

            count++;
        }

        return count;
    }


}