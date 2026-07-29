class Solution {
    public int solution(int a, int b) {
        int val1 = Integer.parseInt(String.valueOf(a) + String.valueOf(b));  
        int val2 = Integer.parseInt(String.valueOf(b) + String.valueOf(a)); 
        return Math.max(val1, val2); 

    }
}