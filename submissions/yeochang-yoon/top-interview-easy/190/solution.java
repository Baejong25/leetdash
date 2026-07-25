class Solution {
    public int reverseBits(int n) {
        int[] arr = new int[32];

        int idx = 0;

        while(n > 0){
            arr[idx] = (n & 1);
            n >>= 1;
            idx++;
        }

        int sum = arr[31];
        int two = 2;
        for(int i = 30; i >= 0; i--){
            if(arr[i] == 1){
                sum += two;
            }
            two *= 2;
        }

        return sum;
    }
}