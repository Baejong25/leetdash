class Solution {
    public int solution(int n, int k) {
        int total = n * 12000 + k * 2000; 
        int service = (n/10) * 2000;
        return total - service; 
    }
}