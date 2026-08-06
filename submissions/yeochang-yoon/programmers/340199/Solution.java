class Solution {
    public int solution(int[] wallet, int[] bill) {

        int ww = Math.max(wallet[0], wallet[1]);
        int wh = Math.min(wallet[0], wallet[1]);
        int bw = Math.max(bill[0], bill[1]);
        int bh = Math.min(bill[0], bill[1]);

        int count = 0;
        while(ww < bw || wh < bh){
            count++;
            bw /= 2;

            int max = Math.max(bw, bh);
            int min = Math.min(bw, bh);
            bw = max;
            bh = min;
        }
        int answer = count;
        return answer;
    }
}